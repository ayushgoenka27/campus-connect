from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.expression import FunctionElement

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class _pair_least(FunctionElement):
    name = "pair_least"
    inherit_cache = True


@compiles(_pair_least, "postgresql")
def _compile_pair_least_pg(element, compiler, **kw):
    return f"LEAST({compiler.process(element.clauses, **kw)})"


@compiles(_pair_least)
def _compile_pair_least_default(element, compiler, **kw):
    return f"min({compiler.process(element.clauses, **kw)})"


class _pair_greatest(FunctionElement):
    name = "pair_greatest"
    inherit_cache = True


@compiles(_pair_greatest, "postgresql")
def _compile_pair_greatest_pg(element, compiler, **kw):
    return f"GREATEST({compiler.process(element.clauses, **kw)})"


@compiles(_pair_greatest)
def _compile_pair_greatest_default(element, compiler, **kw):
    return f"max({compiler.process(element.clauses, **kw)})"


class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint(
            "sender_id",
            "receiver_id",
            name="uq_connections_sender_receiver",
        ),
        Index(
            "uq_connections_user_pair",
            _pair_least(column("sender_id"), column("receiver_id")),
            _pair_greatest(column("sender_id"), column("receiver_id")),
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    receiver_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
        lazy="select",
    )

    receiver: Mapped["User"] = relationship(
        "User",
        foreign_keys=[receiver_id],
        lazy="select",
    )
