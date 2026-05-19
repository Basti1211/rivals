from fastapi import APIRouter
from fastapi.responses import HTMLResponse

k8s_router = APIRouter(tags=["k8s"])


@k8s_router.get('/health',
                summary="Check Liveliness",
                description="Endpoint for Kubernetes to check if the container is still running.")
async def get_health():
    return HTMLResponse(content="OK", status_code=200)
