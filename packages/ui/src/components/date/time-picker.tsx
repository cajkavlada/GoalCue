import { Input } from "../input";

export function TimePicker({
  value,
  onChange,
  onBlur,
}: {
  value: Date;
  onChange: (date: Date) => void;
  onBlur: () => void;
}) {
  function handleChange(newValue: string) {
    const newDate = new Date(value);
    const [hours, minutes, seconds] = newValue.split(":");
    newDate.setHours(
      parseInt(hours ?? "0"),
      parseInt(minutes ?? "0"),
      parseInt(seconds ?? "0")
    );
    onChange(newDate);
  }
  return (
    <Input
      type="time"
      id="time-picker"
      step="1"
      onBlur={onBlur}
      value={value.toTimeString().split(" ")[0]}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
    />
  );
}
