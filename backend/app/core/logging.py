import logging
import sys
from typing import Optional

from .config import get_settings


def configure_logging(log_level: Optional[str] = None) -> None:
    settings = get_settings()
    level_name = log_level or settings.log_level
    level = getattr(logging, level_name.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
