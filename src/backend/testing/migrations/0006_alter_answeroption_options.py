from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("testing", "0005_answeroption_order"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="answeroption",
            options={"ordering": ("order", "created_at", "id")},
        ),
    ]
