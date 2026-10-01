import logging
import time
import uuid

logger = logging.getLogger("haulhour.request")


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.monotonic()
        request.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:64]
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        response_data = getattr(response, "data", {})
        error_code = response_data.get("error", {}).get("code", "") if isinstance(response_data, dict) else ""
        logger.info(
            "request_completed",
            extra={
                "request_id": request.request_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "error_code": error_code,
                "duration_ms": round((time.monotonic() - started) * 1000),
            },
        )
        return response
