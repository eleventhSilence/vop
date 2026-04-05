from django.db import migrations, models
import django.core.validators


def assign_answer_option_order(apps, schema_editor):
    AnswerOption = apps.get_model("testing", "AnswerOption")
    by_question = {}

    option_rows = AnswerOption.objects.all().order_by("question_id", "created_at", "id").values_list("id", "question_id")

    for option_id, question_id in option_rows:
        next_order = by_question.get(question_id, 0) + 1
        by_question[question_id] = next_order
        AnswerOption.objects.filter(id=option_id).update(order=next_order)


class Migration(migrations.Migration):

    dependencies = [
        ("testing", "0004_remove_useranswer_unique_question_per_attempt_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="answeroption",
            name="order",
            field=models.PositiveIntegerField(default=1, validators=[django.core.validators.MinValueValidator(1)]),
        ),
        migrations.RunPython(assign_answer_option_order, migrations.RunPython.noop),
    ]
