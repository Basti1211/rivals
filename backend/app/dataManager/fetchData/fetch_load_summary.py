from app.dataManager.database.connection import count_database_rows
from app.dataManager.database.handleData.sourceFileManager import fetch_all as fetch_source_files
from app.types.responses.model_responses import LoadDataResponse


def fetch_load_summary() -> LoadDataResponse:
    """
    Fetch current load totals and source files without reporting new rows.
    """

    counts = count_database_rows()

    return LoadDataResponse(
        totalTasks=counts["tasks"],
        totalUsers=counts["users"],
        totalLogs=counts["logs"],
        totalAnswers=counts["answers"],
        sourceFiles=fetch_source_files(),
    )
