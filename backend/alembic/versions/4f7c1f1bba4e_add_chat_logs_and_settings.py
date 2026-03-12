"""Add chat logs and settings tables

Revision ID: 4f7c1f1bba4e
Revises: 8928af7ccf1a
Create Date: 2026-03-12 15:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f7c1f1bba4e"
down_revision: Union[str, Sequence[str], None] = "8928af7ccf1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "chat_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_logs_id"), "chat_logs", ["id"], unique=False)

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("system_prompt", sa.String(length=2000), nullable=False),
        sa.Column("strictness", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_settings_id"), "settings", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_settings_id"), table_name="settings")
    op.drop_table("settings")

    op.drop_index(op.f("ix_chat_logs_id"), table_name="chat_logs")
    op.drop_table("chat_logs")
