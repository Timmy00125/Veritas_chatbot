"""add conversations table

Revision ID: c030001051fa
Revises: 4f7c1f1bba4e
Create Date: 2026-03-27 16:39:30.309330

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c030001051fa'
down_revision: Union[str, Sequence[str], None] = '4f7c1f1bba4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_conversations_id', 'conversations', ['id'], unique=False)
    op.create_index('ix_conversations_session_id', 'conversations', ['session_id'], unique=False)

    op.add_column('chat_logs', sa.Column('conversation_id', sa.Integer(), nullable=True))
    op.create_index('ix_chat_logs_conversation_id', 'chat_logs', ['conversation_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_chat_logs_conversation_id', table_name='chat_logs')
    op.drop_column('chat_logs', 'conversation_id')
    op.drop_index('ix_conversations_session_id', table_name='conversations')
    op.drop_index('ix_conversations_id', table_name='conversations')
    op.drop_table('conversations')
