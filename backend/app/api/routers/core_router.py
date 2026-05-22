from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.api.routers.add_data_routes import add_data_router
from app.api.routers.get_data_routes import get_data_router

from app.api.routers.k8s_routes import k8s_router
from app.api.routers.analysis_routes import analysis_router


# use function to avoid import time side effects
def build_router() -> APIRouter:
    # create global router used by api_app in asgi.py
    combined_router = APIRouter()

    # mount imported routers
    combined_router.include_router(add_data_router)
    combined_router.include_router(get_data_router)
    combined_router.include_router(analysis_router)
    combined_router.include_router(k8s_router)

    # add core defaults
    @combined_router.get("/", include_in_schema=False)
    def root(request: Request):
        # "swagger_ui_html" is the FastAPI-internal route name for /docs
        url = request.url_for("swagger_ui_html")
        return RedirectResponse(url=url)  # careful the redirect uses the root_path set in asgi.py!

    return combined_router
