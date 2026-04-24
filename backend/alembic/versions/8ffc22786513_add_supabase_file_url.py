"""add_supabase_file_url

Revision ID: 8ffc22786513
Revises: c030001051fa
Create Date: 2026-04-24 14:59:11.289927

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ffc22786513'
down_revision: Union[str, Sequence[str], None] = 'c030001051fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documents', sa.Column('supabase_file_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('documents', 'supabase_file_url')
