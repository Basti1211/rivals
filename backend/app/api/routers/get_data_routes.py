from fastapi import APIRouter

from app.dataManager.fetchData.fetch_interaction_data import fetch_interaction_data
from app.dataManager.fetchData.fetch_load_summary import fetch_load_summary
from app.dataManager.fetchData.fetch_users_and_tasks import fetch_users_and_tasks
from app.types.responses.model_responses import FetchUsersAndTasks, FetchInteractionDataResponse, LoadDataResponse
from app.types.responses.model_requests import InteractionRequest

get_data_router = APIRouter(prefix="/data", tags=["data"])


@get_data_router.post(
    "/get-user-and-tasks",
    response_model=FetchUsersAndTasks,
    summary="Send all available users and tasks in the database",
    description="Send all available users and tasks in the database.",
)
def get_user_and_tasks() -> FetchUsersAndTasks:
    return fetch_users_and_tasks()


@get_data_router.get(
    "/get-load-summary",
    response_model=LoadDataResponse,
    summary="Send current database load summary",
    description="Send current database row counts and source filenames.",
)
def get_load_summary() -> LoadDataResponse:
    return fetch_load_summary()


@get_data_router.post(
    "/get-interactions",
    response_model=FetchInteractionDataResponse,
    summary="Send all available interaction data from users and tasks in the database",
    description="Send all available interaction data from users and tasks in the database",
)
def get_interactions(request: InteractionRequest) -> FetchInteractionDataResponse:
    return fetch_interaction_data(request)
