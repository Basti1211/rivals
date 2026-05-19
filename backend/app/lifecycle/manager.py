from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import base_paths

@asynccontextmanager
async def app_lifecycle(_: FastAPI):
    print("[app_lifecycle] Startup in progress...")

    print("test")
    yield

    print("[app_lifecycle] Shutdown in progress...")
