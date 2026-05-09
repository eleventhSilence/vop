from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("testing", "0007_answeroption_unique_option_order_per_question"),
    ]

    operations = [
        migrations.AddField(
            model_name="testattempt",
            name="status",
            field=models.CharField(
                choices=[("in_progress", "In progress"), ("completed", "Completed"), ("interrupted", "Interrupted")],
                default="completed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="testattempt",
            name="started_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="testattempt",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="testattempt",
            name="score",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
