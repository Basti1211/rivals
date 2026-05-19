import os

from fastapi import FastAPI
from app.lifecycle.manager import app_lifecycle
from app.api.routers.core_router import build_router

ROOT_PATH = os.getenv("ROOT_PATH", "/api")

# Global setup for the fastAPI endpoint
api_app = FastAPI(
    title="Basic Python Back End",
    description="Basic Python Back End API",
    version="1.0.0",
    lifespan=app_lifecycle,
    root_path=ROOT_PATH,
)

# setup routes
api_app.include_router(build_router())

