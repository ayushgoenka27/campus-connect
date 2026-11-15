"""
Idempotent seed script for Phase 6 (Notifications & Campus Resources).
Seeds curated academic resources and campus events if they do not already exist.
Preserves all existing database records.
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend directory to sys.path so app imports work
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from sqlalchemy import select
from app.db.database import SessionLocal
from app.models.event import Event
from app.models.resource import Resource
from app.models.user import User


def seed_phase6_data():
    db = SessionLocal()
    try:
        # Check if an admin user exists, or use the first user
        admin_user = db.scalar(select(User).where(User.role.in_(["admin", "administrator"])))
        fallback_user = db.scalar(select(User).order_by(User.id.asc()))
        creator_id = admin_user.id if admin_user else (fallback_user.id if fallback_user else None)

        # 1. Curated Resources
        resources_data = [
            {
                "title": "Computer Science & Engineering Syllabus 2024-2028",
                "description": "Comprehensive semester-wise curriculum, subject credits, evaluation scheme, and textbook references for B.Tech CSE.",
                "category": "syllabus",
                "resource_type": "official_doc",
                "url": "https://campus.edu/academics/syllabus-cse-2024.pdf",
            },
            {
                "title": "Data Structures & Algorithms Question Bank (2021-2024)",
                "description": "Mid-term and end-term past question papers with model answers, asymptotic analysis questions, and tree traversal problems.",
                "category": "question_paper",
                "resource_type": "drive_link",
                "url": "https://campus.edu/library/dsa-qb-archive.pdf",
            },
            {
                "title": "Database Management Systems Lab Manual & Schema Dump",
                "description": "Structured laboratory experiments covering SQL DDL/DML, normal forms, stored procedures, triggers, and ACID transactions.",
                "category": "lab_manual",
                "resource_type": "official_doc",
                "url": "https://campus.edu/labs/dbms-manual-v2.pdf",
            },
            {
                "title": "Campus Placement & Career Preparation Guide 2025-2026",
                "description": "Resume guidelines, technical interview roadmaps, coding platform tips, and past recruitment question archives.",
                "category": "handbook",
                "resource_type": "official_doc",
                "url": "https://campus.edu/cdc/placement-guide-2025.pdf",
            },
            {
                "title": "Central Digital Library & Research Journal Gateway",
                "description": "Authorized institutional gateway for IEEE Xplore, ACM Digital Library, SpringerLink, and ScienceDirect journals.",
                "category": "portal",
                "resource_type": "library_portal",
                "url": "https://library.campus.edu/portal",
            },
        ]

        inserted_resources = 0
        for r_item in resources_data:
            existing = db.scalar(select(Resource).where(Resource.title == r_item["title"]))
            if not existing:
                res = Resource(
                    title=r_item["title"],
                    description=r_item["description"],
                    category=r_item["category"],
                    resource_type=r_item["resource_type"],
                    url=r_item["url"],
                    created_by_id=creator_id,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(res)
                inserted_resources += 1

        # 2. Curated Events
        now = datetime.utcnow()
        events_data = [
            {
                "title": "Annual Hackathon 2026: Code The Future",
                "description": "36-hour flagship hackathon where multidisciplinary teams build AI-driven campus solutions and sustainable systems. Cash prizes and internship fast-tracks.",
                "category": "hackathon",
                "start_date": now + timedelta(days=14, hours=2),
                "end_date": now + timedelta(days=15, hours=14),
                "location": "Main Campus Auditorium & Virtual Arena",
                "registration_url": "https://hackathon.campus.edu/register",
                "capacity": 200,
            },
            {
                "title": "Hands-On Workshop: Scalable Microservices with FastAPI & WebSockets",
                "description": "Interactive technical workshop demonstrating asynchronous Python architecture, PostgreSQL indexing, and bi-directional messaging protocols.",
                "category": "workshop",
                "start_date": now + timedelta(days=7, hours=4),
                "end_date": now + timedelta(days=7, hours=7),
                "location": "Advanced Computing Lab 3",
                "registration_url": "https://workshops.campus.edu/fastapi",
                "capacity": 60,
            },
            {
                "title": "Campus Tech Symposium: AI in Modern Industry",
                "description": "Distinguished guest lecture series with industry experts discussing large language models, agent architectures, and production safety.",
                "category": "seminar",
                "start_date": now + timedelta(days=21, hours=3),
                "end_date": now + timedelta(days=21, hours=6),
                "location": "Seminar Hall A",
                "registration_url": None,
                "capacity": 150,
            },
            {
                "title": "Inter-Department Cultural Fest: Harmony 2026",
                "description": "Celebrating campus diversity through music, theater, photography exhibits, and literary competitions.",
                "category": "cultural",
                "start_date": now + timedelta(days=30, hours=10),
                "end_date": now + timedelta(days=32, hours=18),
                "location": "Open Air Amphitheatre",
                "registration_url": None,
                "capacity": 500,
            },
        ]

        inserted_events = 0
        for e_item in events_data:
            existing = db.scalar(select(Event).where(Event.title == e_item["title"]))
            if not existing:
                evt = Event(
                    title=e_item["title"],
                    description=e_item["description"],
                    category=e_item["category"],
                    start_date=e_item["start_date"],
                    end_date=e_item["end_date"],
                    location=e_item["location"],
                    registration_url=e_item["registration_url"],
                    capacity=e_item["capacity"],
                    created_by_id=creator_id,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(evt)
                inserted_events += 1

        db.commit()
        print(f"Seed complete. Inserted {inserted_resources} resources, {inserted_events} events.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_phase6_data()
