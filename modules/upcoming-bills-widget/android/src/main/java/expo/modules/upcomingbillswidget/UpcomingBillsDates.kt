package expo.modules.upcomingbillswidget

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

// Mirrors formatDueDate / formatDaysLate in utils/dateHelpers.ts.
object UpcomingBillsDates {
    private const val MILLIS_PER_DAY = 86_400_000L

    private fun dayNumber(year: Int, month: Int, day: Int): Long {
        val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        utc.clear()
        utc.set(year, month, day)
        return utc.timeInMillis / MILLIS_PER_DAY
    }

    private fun parse(due: String): IntArray {
        val parts = due.split("-")
        return intArrayOf(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
    }

    // "YYYY-MM-DD" is a local calendar date, so compare it against the local date today.
    fun daysUntil(due: String, now: Calendar = Calendar.getInstance()): Int {
        val (year, month, day) = parse(due).toList()
        val today = dayNumber(now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH))
        return (dayNumber(year, month, day) - today).toInt()
    }

    fun dueText(due: String): String {
        val diff = daysUntil(due)
        return when {
            diff < 0 -> "${-diff} ${if (diff == -1) "day" else "days"} late"
            diff == 0 -> "Today"
            diff == 1 -> "Tomorrow"
            diff < 7 -> "in $diff days"
            else -> {
                val (year, month, day) = parse(due).toList()
                val local = Calendar.getInstance()
                local.clear()
                local.set(year, month, day)
                SimpleDateFormat("MMM d", Locale.ENGLISH).format(local.time)
            }
        }
    }

    fun nextMidnightMillis(now: Calendar = Calendar.getInstance()): Long {
        val next = now.clone() as Calendar
        next.add(Calendar.DAY_OF_MONTH, 1)
        next.set(Calendar.HOUR_OF_DAY, 0)
        next.set(Calendar.MINUTE, 0)
        next.set(Calendar.SECOND, 0)
        next.set(Calendar.MILLISECOND, 0)
        return next.timeInMillis
    }
}
