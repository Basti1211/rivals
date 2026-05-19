from app.dataManager.database.handleData.sourceFileManager import delete_with_data
from app.dataManager.fetchData.fetch_load_summary import fetch_load_summary
from app.types.responses.model_responses import LoadDataResponse


def delete_source_file_data(source_file_id: int) -> LoadDataResponse:
    """
    Delete all data associated with a source file and return the refreshed summary.
    """

    try:
        delete_with_data(source_file_id)
        return fetch_load_summary()
    except Exception as error:
        response = fetch_load_summary()
        response.errorMessage = f"Failed to delete source file data: {error}"
        return response
