from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0002_courseenrollment_is_theory_completed_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="courseenrollment",
            name="progress_status",
            field=models.CharField(default="enrolled", max_length=50),
        ),
    ]
