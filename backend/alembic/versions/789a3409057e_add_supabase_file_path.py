"""add_supabase_file_path

Revision ID: 789a3409057e
Revises: 8ffc22786513
Create Date: 2026-04-24 15:53:40.864903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '789a3409057e'
down_revision: Union[str, Sequence[str], None] = '8ffc22786513'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documents', sa.Column('supabase_file_path', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('documents', 'supabase_file_path')
