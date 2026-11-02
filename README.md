# Task Default Deadline Time - Odoo 19

Default time for `project.task.date_deadline`: **08:00**.

Version 19.0.1.6.0 removes the invalid custom `pickerProps` key that caused
`DateTimePickerPopover` Owl prop validation errors, while preserving the
original working behaviour by marking an existing supported callback instead.

Expected behaviour:
- Empty deadline -> time picker starts at 08:00.
- Clicking only a calendar date -> that date is selected at 08:00.
- Manually changing the time -> the chosen time is preserved.
- Existing deadlines are not automatically changed.
