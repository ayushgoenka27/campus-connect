"""
Campus Connect — Backend Entry Point

The canonical application module is: app/main.py

To start the development server, run from this directory:
    uvicorn app.main:app --reload

This file exists only to avoid confusion if someone runs
`python main.py` from the project root.
"""

# Re-export the app for tooling that may reference main:app
from app.main import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
