"""Grading APIRouter — thin wrappers over the grading domain functions.

Mounted at the app root by backend/main.py. Endpoints:
  POST /grade             — multipart visual/hybrid grading
  POST /grade/functional  — JSON yes/no functional grading

No business logic here: parse request → call domain function → shape response.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from .category_map import get_path
from .functional_grader import grade_functional
from .grading_agent import grade_visual
from .schemas import FunctionalGradeRequest

router = APIRouter(tags=["grading"])


def _save_uploads(files: List[UploadFile], dest_dir: Path) -> list[str]:
    """Persist uploaded files to a temp dir; return their paths."""
    paths: list[str] = []
    for f in files:
        # Guard against empty file slots from the form.
        if not f or not f.filename:
            continue
        out = dest_dir / Path(f.filename).name
        with out.open("wb") as buf:
            shutil.copyfileobj(f.file, buf)
        paths.append(str(out))
    return paths


@router.post("/grade")
async def grade(
    category: str = Form(...),
    reference_images: List[UploadFile] = File(default=[]),
    inspection_images: List[UploadFile] = File(default=[]),
):
    """Visual / hybrid grading. Multipart: category + two image groups.

    Uploads are saved to a temp dir that is cleaned up after grading.
    """
    path = get_path(category)

    tmp = Path(tempfile.mkdtemp(prefix="relay_"))
    try:
        ref_dir = tmp / "reference"
        insp_dir = tmp / "inspection"
        ref_dir.mkdir()
        insp_dir.mkdir()

        ref_paths = _save_uploads(reference_images, ref_dir)
        insp_paths = _save_uploads(inspection_images, insp_dir)

        if not insp_paths:
            return JSONResponse(
                {
                    "grade": "ERROR",
                    "reasoning": "No inspection images uploaded.",
                    "path": path,
                },
                status_code=400,
            )

        # visual + hybrid both run the visual agent in this MVP.
        # (hybrid's answer-merge is a Phase 2 TODO; functional-only categories
        #  should use /grade/functional.)
        result = grade_visual(ref_paths, insp_paths, category)
        result["path"] = path
        return JSONResponse(result)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@router.post("/grade/functional")
async def grade_functional_endpoint(req: FunctionalGradeRequest):
    """Functional grading from yes/no answers."""
    result = grade_functional(req.answers, req.category)
    result["path"] = "functional"
    return JSONResponse(result)
