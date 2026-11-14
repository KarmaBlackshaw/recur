package expo.modules.upcomingbillswidget

import java.util.Calendar
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class UpcomingBillsDatesTest(private val today: String, private val due: String, private val caption: String) {
    @Test
    fun dueTextMatchesTheSharedCaptionTable() {
        val (year, month, day) = today.split("-").map { it.toInt() }
        val now = Calendar.getInstance()
        now.clear()
        now.set(year, month - 1, day, 12, 0, 0)
        assertEquals("due-captions.txt: $today | $due | $caption", caption, UpcomingBillsDates.dueText(due, now))
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0} | {1} | {2}")
        fun rows(): List<Array<String>> {
            val table = checkNotNull(UpcomingBillsDatesTest::class.java.classLoader?.getResourceAsStream("due-captions.txt")) { "due-captions.txt missing" }
            val rows = table.bufferedReader().readLines().map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("#") }
            check(rows.isNotEmpty()) { "due-captions.txt has no rows" }
            return rows.map { row -> row.split("|").map { it.trim() }.toTypedArray() }
        }
    }
}
