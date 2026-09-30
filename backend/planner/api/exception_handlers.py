from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", "unknown")
    if response is None:
        return response
    field_errors = response.data if isinstance(response.data, dict) else {}
    response.data = {
        "error": {
            "code": "VALIDATION_ERROR" if response.status_code == 400 else "REQUEST_FAILED",
            "message": "Please correct the highlighted fields."
            if response.status_code == 400
            else "The request could not be completed.",
            "field_errors": field_errors,
            "request_id": request_id,
        }
    }
    return response
