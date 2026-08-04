from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models. Keep this here to centralize persistence concerns."""

    pass
