"""Print all registered routes in the FastAPI app."""

from app.main import app

for route in sorted(app.routes, key=lambda r: getattr(r, "path", "")):
    methods = getattr(route, "methods", None)
    path = getattr(route, "path", "?")
    print(f"{path:50s}  {sorted(methods) if methods else ''}")
