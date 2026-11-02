/** @odoo-module **/

import { onWillRender, useEffect, useRef, useState } from "@odoo/owl";
import { DateTimePicker } from "@web/core/datetime/datetime_picker";
import { useDateTimePicker } from "@web/core/datetime/datetime_picker_hook";
import { Time } from "@web/core/l10n/time";
import { areDatesEqual } from "@web/core/l10n/dates";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import {
    DateTimeField,
    dateTimeField,
} from "@web/views/fields/datetime/datetime_field";

const { DateTime } = luxon;
const DEFAULT_HOUR = 19;

/**
 * Odoo 19 validates DateTimePickerPopover.pickerProps strictly.
 * Therefore we must NOT add a custom key such as taskDeadlineDefaultHour
 * to pickerProps.
 *
 * Instead, this module tags the already-supported onToggleRange callback.
 * The DateTimePicker patch can recognise only our project.task deadline
 * picker through that callback, without changing the public props shape.
 */
function getDeadlineDefaultHour(props) {
    return props?.onToggleRange?._taskDeadlineDefaultHour;
}

patch(DateTimePicker.prototype, {
    getTimeValues(props) {
        const defaultHour = getDeadlineDefaultHour(props);
        if (defaultHour === undefined) {
            return super.getTimeValues(...arguments);
        }

        const timeValues = this.values.map(
            (value, index) =>
                new Time({
                    hour: value
                        ? value.hour
                        : index === 1 && !this.values[1]
                          ? defaultHour + 1
                          : defaultHour,
                    minute: value?.minute || 0,
                    second: value?.second || 0,
                })
        );

        if (props.range) {
            return timeValues;
        }

        const result = [];
        result[props.focusedDateIndex] = timeValues[props.focusedDateIndex];
        return result;
    },

    validateAndSelect(value, valueIndex, unit) {
        const defaultHour = getDeadlineDefaultHour(this.props);
        if (defaultHour === undefined) {
            return super.validateAndSelect(...arguments);
        }

        if (!this.props.onSelect) {
            return false;
        }

        const result = [...this.values];
        const userZone =
            user.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        if (this.props.type === "datetime") {
            const timeValue = this.state.timeValues[valueIndex];
            const hour = timeValue?.hour ?? defaultHour;
            const minute = timeValue?.minute ?? 0;
            const second = timeValue?.second ?? 0;

            // Rebuild the clicked calendar date with the time currently shown
            // in the time picker. For an empty deadline that time is 08:00.
            // Creating it directly in the user's timezone also avoids the
            // Europe/Lisbon DST +1h issue previously seen by the user.
            result[valueIndex] = DateTime.fromObject(
                {
                    year: value.year,
                    month: value.month,
                    day: value.day,
                    hour,
                    minute,
                    second,
                    millisecond: 0,
                },
                { zone: userZone }
            );
        } else {
            result[valueIndex] = value;
        }

        if (result[valueIndex] < this.minDate || result[valueIndex] > this.maxDate) {
            return false;
        }

        this.props.onSelect(result.length === 2 ? result : result[0], unit);
        return true;
    },
});

export class DefaultTaskDeadlineHourField extends DateTimeField {
    setup() {
        const onToggleRange = () => {
            this.state.range = !this.state.range;

            if (this.state.range) {
                let values = this.values;
                const optionalFieldIndex = values[0] ? 1 : 0;

                if (!values[0] && !values[1]) {
                    const userZone =
                        user.tz ||
                        Intl.DateTimeFormat().resolvedOptions().timeZone ||
                        "UTC";
                    const initial = DateTime.now()
                        .setZone(userZone)
                        .set({
                            hour: DEFAULT_HOUR,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                        });
                    values = [initial, initial.plus({ hours: 1 })];
                }

                values[optionalFieldIndex] = optionalFieldIndex
                    ? values[0].plus({ hours: 1 })
                    : values[1].minus({ hours: 1 });

                this.state.focusedDateIndex = 0;
                this.state.value = values;
            } else {
                const mainFieldIndex =
                    this.props.name === this.startDateField ? 0 : 1;
                this.state.focusedDateIndex = mainFieldIndex;
                this.state.value[mainFieldIndex ? 0 : 1] = false;
            }
        };

        // Marker is attached to a function that is already a valid Odoo prop.
        // It is deliberately NOT an extra pickerProps key.
        onToggleRange._taskDeadlineDefaultHour = DEFAULT_HOUR;

        const getPickerProps = () => {
            const value = this.getRecordValue();
            const pickerProps = {
                value,
                type: this.field.type,
                range: this.isRange(value),
                showRangeToggler:
                    this.relatedField &&
                    !this.props.required &&
                    !this.props.alwaysRange,
                onToggleRange,
            };

            if (this.props.maxDate) {
                pickerProps.maxDate = this.parseLimitDate(this.props.maxDate);
            }
            if (this.props.minDate) {
                pickerProps.minDate = this.parseLimitDate(this.props.minDate);
            }
            if (!isNaN(this.props.rounding)) {
                pickerProps.rounding = this.props.rounding;
            } else if (this.props.showSeconds) {
                pickerProps.rounding = 0;
            }
            if (this.props.maxPrecision) {
                pickerProps.maxPrecision = this.props.maxPrecision;
            }
            if (this.props.minPrecision) {
                pickerProps.minPrecision = this.props.minPrecision;
            }

            return pickerProps;
        };

        const dateTimePicker = useDateTimePicker({
            target: "root",
            showSeconds: this.props.showSeconds,
            get pickerProps() {
                return getPickerProps();
            },
            onChange: () => {
                this.state.range = this.isRange(this.state.value);
            },
            onClose: () => {
                this.picker.activeInput = "";
            },
            onApply: async () => {
                const toUpdate = {};

                if (Array.isArray(this.state.value)) {
                    [
                        toUpdate[this.startDateField],
                        toUpdate[this.endDateField],
                    ] = this.state.value;
                } else {
                    toUpdate[this.props.name] = this.state.value;
                }

                for (const fieldName in toUpdate) {
                    if (
                        areDatesEqual(
                            toUpdate[fieldName],
                            this.props.record.data[fieldName]
                        )
                    ) {
                        delete toUpdate[fieldName];
                    }
                }

                if (Object.keys(toUpdate).length) {
                    await this.props.record.update(toUpdate);
                }
            },
        });

        this.state = useState(dateTimePicker.state);
        this.picker = useState({ activeInput: "" });
        this.openPicker = dateTimePicker.open;

        this.startDate = useRef("start-date");
        this.endDate = useRef("end-date");

        useEffect(
            () => {
                [this.startDate, this.endDate].forEach((ref, index) => {
                    if (
                        ref.el?.getAttribute("data-field") ===
                        this.picker.activeInput
                    ) {
                        ref.el.focus();
                        this.openPicker(index);
                    }
                });
            },
            () => [
                this.startDate.el?.tagName,
                this.endDate.el?.tagName,
                this.picker.activeInput,
            ]
        );

        onWillRender(() => this.triggerIsDirty());
        this.futureWarningMsg = _t("This date is in the future");
    }
}

registry.category("fields").add("default_task_deadline_hour_datetime", {
    ...dateTimeField,
    component: DefaultTaskDeadlineHourField,
});
