"""initial_schema

Revision ID: 20260804120000
Revises: None
Create Date: 2026-08-04 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260804120000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("email <> ''", name="ck_user_email_not_empty"),
        sa.CheckConstraint("full_name <> ''", name="ck_user_full_name_not_empty"),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=False)
    op.create_index("idx_users_created_at", "users", ["created_at"], unique=False)

    op.create_table(
        "farms",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location_city", sa.String(length=255), nullable=True),
        sa.Column("location_country", sa.String(length=255), nullable=True),
        sa.Column("timezone", sa.String(length=100), nullable=False, server_default="UTC"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_farms"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_farms_created_by_users", ondelete="RESTRICT"),
        sa.CheckConstraint("name <> ''", name="ck_farm_name_not_empty"),
    )
    op.create_index("idx_farms_created_by", "farms", ["created_by"], unique=False)
    op.create_index("idx_farms_is_active", "farms", ["is_active"], unique=False)

    op.create_table(
        "farm_members",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("farm_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("invited_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_farm_members"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], name="fk_farm_members_farm_id_farms", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_farm_members_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], name="fk_farm_members_invited_by_users", ondelete="SET NULL"),
        sa.CheckConstraint("role IN ('owner', 'manager', 'member', 'viewer')", name="ck_farm_member_role"),
    )
    op.create_index("idx_farm_members_farm_id", "farm_members", ["farm_id"], unique=False)
    op.create_index("idx_farm_members_user_id", "farm_members", ["user_id"], unique=False)
    op.create_index("idx_farm_members_role", "farm_members", ["role"], unique=False)

    op.create_table(
        "farm_settings",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("farm_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("default_language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("default_currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("timezone", sa.String(length=100), nullable=False, server_default="Asia/Kolkata"),
        sa.Column("breed_display_mode", sa.String(length=20), nullable=False, server_default="canonical"),
        sa.Column("use_local_breed_names", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_farm_settings"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], name="fk_farm_settings_farm_id_farms", ondelete="CASCADE"),
        sa.UniqueConstraint("farm_id", name="uq_farm_settings_farm_id"),
        sa.CheckConstraint("default_language <> ''", name="ck_farm_settings_default_language_not_empty"),
        sa.CheckConstraint("default_currency <> ''", name="ck_farm_settings_default_currency_not_empty"),
        sa.CheckConstraint("breed_display_mode IN ('canonical', 'alias', 'auto')", name="ck_farm_settings_breed_display_mode"),
    )
    op.create_index("idx_farm_settings_farm_id", "farm_settings", ["farm_id"], unique=False)
    op.create_index("idx_farm_settings_language", "farm_settings", ["default_language"], unique=False)

    op.create_table(
        "user_preference",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("preferred_currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("breed_display_preference", sa.String(length=20), nullable=False, server_default="canonical"),
        sa.Column("show_local_names", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_user_preference"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_preference_user_id_users", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_user_preference_user_id"),
        sa.CheckConstraint("preferred_language <> ''", name="ck_user_preference_language_not_empty"),
        sa.CheckConstraint("preferred_currency <> ''", name="ck_user_preference_currency_not_empty"),
        sa.CheckConstraint("breed_display_preference IN ('canonical', 'alias', 'auto')", name="ck_user_preference_breed_display_mode"),
    )
    op.create_index("idx_user_preference_user_id", "user_preference", ["user_id"], unique=False)
    op.create_index("idx_user_preference_language", "user_preference", ["preferred_language"], unique=False)

    op.create_table(
        "breed_master",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("canonical_name", sa.String(length=150), nullable=False),
        sa.Column("breed_category", sa.String(length=30), nullable=False),
        sa.Column("species", sa.String(length=30), nullable=False, server_default="cattle"),
        sa.Column("origin_region", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_breed_master"),
        sa.CheckConstraint("canonical_name <> ''", name="ck_breed_master_canonical_name_not_empty"),
        sa.CheckConstraint("breed_category IN ('indigenous', 'exotic', 'crossbreed', 'other')", name="ck_breed_master_category"),
        sa.CheckConstraint("species <> ''", name="ck_breed_master_species_not_empty"),
    )
    op.create_index("idx_breed_master_category", "breed_master", ["breed_category"], unique=False)
    op.create_index("idx_breed_master_is_active", "breed_master", ["is_active"], unique=False)
    op.create_index("idx_breed_master_name", "breed_master", ["canonical_name"], unique=False)

    op.create_table(
        "breed_alias",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("breed_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("alias_text", sa.String(length=200), nullable=False),
        sa.Column("language_code", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("alias_type", sa.String(length=30), nullable=False, server_default="regional"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_breed_alias"),
        sa.ForeignKeyConstraint(["breed_id"], ["breed_master.id"], name="fk_breed_alias_breed_id_breed_master", ondelete="CASCADE"),
        sa.CheckConstraint("alias_text <> ''", name="ck_breed_alias_text_not_empty"),
        sa.CheckConstraint("language_code <> ''", name="ck_breed_alias_language_code_not_empty"),
        sa.CheckConstraint("alias_type IN ('regional', 'spelling', 'translation', 'local_name')", name="ck_breed_alias_type"),
    )
    op.create_index("idx_breed_alias_breed_id", "breed_alias", ["breed_id"], unique=False)
    op.create_index("idx_breed_alias_language_code", "breed_alias", ["language_code"], unique=False)
    op.create_index("idx_breed_alias_type", "breed_alias", ["alias_type"], unique=False)

    op.create_table(
        "cows",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("farm_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("tag_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("breed_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("sex", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("weight_kg", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("lactation_number", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_cows"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], name="fk_cows_farm_id_farms", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["breed_id"], ["breed_master.id"], name="fk_cows_breed_id_breed_master", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_cows_created_by_users", ondelete="SET NULL"),
        sa.UniqueConstraint("tag_id", name="uq_cows_tag_id"),
        sa.CheckConstraint("status IN ('active', 'dry', 'sick', 'deceased', 'sold')", name="ck_cow_status"),
        sa.CheckConstraint("lactation_number IS NULL OR lactation_number > 0", name="ck_cow_lactation"),
        sa.CheckConstraint("weight_kg IS NULL OR weight_kg > 0", name="ck_cow_weight"),
    )
    op.create_index("idx_cows_farm_id", "cows", ["farm_id"], unique=False)
    op.create_index("idx_cows_status", "cows", ["status"], unique=False)
    op.create_index("idx_cows_tag_id", "cows", ["tag_id"], unique=False)
    op.create_index("idx_cows_breed_id", "cows", ["breed_id"], unique=False)

    op.create_table(
        "daily_observations",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cow_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=False),
        sa.Column("milk_produced_liters", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("feed_quantity_kg", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("symptoms", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("observed_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_daily_observations"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], name="fk_daily_observations_cow_id_cows", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["observed_by"], ["users.id"], name="fk_daily_observations_observed_by_users", ondelete="SET NULL"),
    )
    op.create_index("idx_daily_observations_cow_id", "daily_observations", ["cow_id"], unique=False)
    op.create_index("idx_daily_observations_date", "daily_observations", ["observation_date"], unique=False)
    op.create_index("idx_daily_observations_observed_by", "daily_observations", ["observed_by"], unique=False)

    op.create_table(
        "weather_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("farm_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("temperature", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("humidity", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("wind_speed", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("rainfall", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("THI", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("weather_code", sa.String(length=50), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_weather_logs"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], name="fk_weather_logs_farm_id_farms", ondelete="CASCADE"),
    )
    op.create_index("idx_weather_logs_farm_id", "weather_logs", ["farm_id"], unique=False)
    op.create_index("idx_weather_logs_recorded_at", "weather_logs", ["recorded_at"], unique=False)

    op.create_table(
        "milk_predictions",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cow_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("observation_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("predicted_milk_yield", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("model_version", sa.String(length=100), nullable=False),
        sa.Column("confidence_score", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("prediction_timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_milk_predictions"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], name="fk_milk_predictions_cow_id_cows", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["observation_id"], ["daily_observations.id"], name="fk_milk_predictions_observation_id_daily_observations", ondelete="SET NULL"),
    )
    op.create_index("idx_milk_predictions_cow_id", "milk_predictions", ["cow_id"], unique=False)
    op.create_index("idx_milk_predictions_observation_id", "milk_predictions", ["observation_id"], unique=False)
    op.create_index("idx_milk_predictions_timestamp", "milk_predictions", ["prediction_timestamp"], unique=False)

    op.create_table(
        "health_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cow_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("alert_level", sa.String(length=20), nullable=False),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_health_alerts"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], name="fk_health_alerts_cow_id_cows", ondelete="CASCADE"),
    )
    op.create_index("idx_health_alerts_cow_id", "health_alerts", ["cow_id"], unique=False)
    op.create_index("idx_health_alerts_level", "health_alerts", ["alert_level"], unique=False)
    op.create_index("idx_health_alerts_resolved", "health_alerts", ["resolved"], unique=False)

    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cow_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("alert_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("recommendation_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_recommendations"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], name="fk_recommendations_cow_id_cows", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["alert_id"], ["health_alerts.id"], name="fk_recommendations_alert_id_health_alerts", ondelete="CASCADE"),
    )
    op.create_index("idx_recommendations_cow_id", "recommendations", ["cow_id"], unique=False)
    op.create_index("idx_recommendations_alert_id", "recommendations", ["alert_id"], unique=False)
    op.create_index("idx_recommendations_type", "recommendations", ["recommendation_type"], unique=False)

    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("cow_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("activity_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_activity_logs"),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], name="fk_activity_logs_cow_id_cows", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_activity_logs_user_id_users", ondelete="SET NULL"),
    )
    op.create_index("idx_activity_logs_cow_id", "activity_logs", ["cow_id"], unique=False)
    op.create_index("idx_activity_logs_user_id", "activity_logs", ["user_id"], unique=False)
    op.create_index("idx_activity_logs_type", "activity_logs", ["activity_type"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_activity_logs_type", table_name="activity_logs")
    op.drop_index("idx_activity_logs_user_id", table_name="activity_logs")
    op.drop_index("idx_activity_logs_cow_id", table_name="activity_logs")
    op.drop_table("activity_logs")

    op.drop_index("idx_recommendations_type", table_name="recommendations")
    op.drop_index("idx_recommendations_alert_id", table_name="recommendations")
    op.drop_index("idx_recommendations_cow_id", table_name="recommendations")
    op.drop_table("recommendations")

    op.drop_index("idx_health_alerts_resolved", table_name="health_alerts")
    op.drop_index("idx_health_alerts_level", table_name="health_alerts")
    op.drop_index("idx_health_alerts_cow_id", table_name="health_alerts")
    op.drop_table("health_alerts")

    op.drop_index("idx_milk_predictions_timestamp", table_name="milk_predictions")
    op.drop_index("idx_milk_predictions_observation_id", table_name="milk_predictions")
    op.drop_index("idx_milk_predictions_cow_id", table_name="milk_predictions")
    op.drop_table("milk_predictions")

    op.drop_index("idx_weather_logs_recorded_at", table_name="weather_logs")
    op.drop_index("idx_weather_logs_farm_id", table_name="weather_logs")
    op.drop_table("weather_logs")

    op.drop_index("idx_daily_observations_observed_by", table_name="daily_observations")
    op.drop_index("idx_daily_observations_date", table_name="daily_observations")
    op.drop_index("idx_daily_observations_cow_id", table_name="daily_observations")
    op.drop_table("daily_observations")

    op.drop_index("idx_cows_breed_id", table_name="cows")
    op.drop_index("idx_cows_tag_id", table_name="cows")
    op.drop_index("idx_cows_status", table_name="cows")
    op.drop_index("idx_cows_farm_id", table_name="cows")
    op.drop_table("cows")

    op.drop_index("idx_breed_alias_type", table_name="breed_alias")
    op.drop_index("idx_breed_alias_language_code", table_name="breed_alias")
    op.drop_index("idx_breed_alias_breed_id", table_name="breed_alias")
    op.drop_table("breed_alias")

    op.drop_index("idx_breed_master_name", table_name="breed_master")
    op.drop_index("idx_breed_master_is_active", table_name="breed_master")
    op.drop_index("idx_breed_master_category", table_name="breed_master")
    op.drop_table("breed_master")

    op.drop_index("idx_user_preference_language", table_name="user_preference")
    op.drop_index("idx_user_preference_user_id", table_name="user_preference")
    op.drop_table("user_preference")

    op.drop_index("idx_farm_settings_language", table_name="farm_settings")
    op.drop_index("idx_farm_settings_farm_id", table_name="farm_settings")
    op.drop_table("farm_settings")

    op.drop_index("idx_farm_members_role", table_name="farm_members")
    op.drop_index("idx_farm_members_user_id", table_name="farm_members")
    op.drop_index("idx_farm_members_farm_id", table_name="farm_members")
    op.drop_table("farm_members")

    op.drop_index("idx_farms_is_active", table_name="farms")
    op.drop_index("idx_farms_created_by", table_name="farms")
    op.drop_table("farms")

    op.drop_index("idx_users_created_at", table_name="users")
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")
