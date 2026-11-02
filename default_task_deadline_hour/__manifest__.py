{
    "name": "Task Default Deadline Time",
    "version": "19.0.1.6.0",
    "summary": "Uses 08:00 as the default time when selecting a task deadline without choosing a time.",
    "category": "Services/Project",
    "author": "Cátia Silva Advicebiz",
    "license": "LGPL-3",
    "depends": ["project", "web"],
    "data": [
        "views/project_task_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "default_task_deadline_hour/static/src/js/task_deadline_datetime.js",
        ],
    },
    "installable": True,
    "application": False,
}
