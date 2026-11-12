from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ScenariGo Discrete Optimization & Simulation API",
    description=(
        "Discrete optimization and multi-modal logistics scenario simulation engine. "
        "Models multi-echelon inventory replenishment, Ford-Fulkerson circulation with lower bounds, "
        "and Dijkstra fleet dispatch across Peninsular and East Malaysia."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for local dev frontend (Vite port 5173 / 3000 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ScenariGo Backend",
        "version": "0.1.0",
    }


@app.get("/", tags=["System"])
def root_info() -> dict[str, str]:
    return {
        "message": "Welcome to ScenariGo Backend API",
        "docs": "/docs",
        "health": "/health",
        "stage1_feasibility": "/api/v1/feasibility",
    }
