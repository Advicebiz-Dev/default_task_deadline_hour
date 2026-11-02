from odoo import models


class ProjectTask(models.Model):
    _inherit = "project.task"

    # Preserve the existing ordering behaviour of the original custom module.
    _order = "priority desc, sequence, date_deadline asc, create_date asc, id asc"
