package expo.modules.upcomingbillswidget

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener

// Runs the JS refresh task (index.ts) in-process, the way HeadlessJsTaskService does under
// bridgeless, so the widget's rows are rebuilt from the database without the app open.
// A job instead of a service because a broadcast can't start a background service on O+.
class UpcomingBillsRefreshJobService : JobService() {
    private val handler = Handler(Looper.getMainLooper())
    private var current: RefreshRun? = null

    override fun onStartJob(params: JobParameters): Boolean {
        handler.post {
            current?.release()
            current = RefreshRun(params).also { it.start() }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        handler.post { current?.release() }
        return false
    }

    private inner class RefreshRun(private val params: JobParameters) : HeadlessJsTaskEventListener {
        private var done = false
        private var host: ReactHost? = null
        private var instanceListener: ReactInstanceEventListener? = null
        private var tasks: HeadlessJsTaskContext? = null
        private var taskId = NO_TASK
        private val timeout = Runnable { finish() }

        fun start() {
            handler.postDelayed(timeout, JOB_TIMEOUT_MS)
            try {
                val reactHost = (application as? ReactApplication)?.reactHost ?: return finish()
                host = reactHost
                val context = reactHost.currentReactContext
                if (context != null) {
                    run(context)
                    return
                }
                val listener = object : ReactInstanceEventListener {
                    override fun onReactContextInitialized(context: ReactContext) {
                        reactHost.removeReactInstanceEventListener(this)
                        handler.post { run(context) }
                    }
                }
                instanceListener = listener
                reactHost.addReactInstanceEventListener(listener)
                reactHost.start()
            } catch (error: RuntimeException) {
                Log.e(TAG, "Couldn't start React for the widget refresh", error)
                finish()
            }
        }

        private fun run(context: ReactContext) {
            if (done) return
            try {
                val headless = HeadlessJsTaskContext.getInstance(context)
                tasks = headless
                headless.addTaskEventListener(this)
                taskId = headless.startTask(
                    HeadlessJsTaskConfig(
                        UpcomingBillsWidgetContract.REFRESH_TASK,
                        Arguments.createMap(),
                        TASK_TIMEOUT_MS,
                        true,
                    ),
                )
            } catch (error: RuntimeException) {
                Log.e(TAG, "Couldn't run the widget refresh task", error)
                finish()
            }
        }

        override fun onHeadlessJsTaskStart(taskId: Int) = Unit

        override fun onHeadlessJsTaskFinish(taskId: Int) {
            if (taskId == this.taskId) finish()
        }

        fun release() {
            if (done) return
            done = true
            handler.removeCallbacks(timeout)
            instanceListener?.let { host?.removeReactInstanceEventListener(it) }
            tasks?.removeTaskEventListener(this)
            if (current === this) current = null
        }

        private fun finish() {
            if (done) return
            release()
            jobFinished(params, false)
        }
    }

    companion object {
        private const val TAG = "UpcomingBillsRefresh"
        private const val NO_TASK = -1
        private const val TASK_TIMEOUT_MS = 30_000L
        // Covers a bundle that never loads (a debug build with Metro down) so the job still ends.
        private const val JOB_TIMEOUT_MS = 60_000L

        fun schedule(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            val component = ComponentName(context, UpcomingBillsRefreshJobService::class.java)
            try {
                // An expedited job runs right away; once its quota is spent, schedule() fails and a
                // plain job runs when the system next lets the app work.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val expedited = JobInfo.Builder(UpcomingBillsWidgetContract.REFRESH_JOB_ID, component)
                        .setExpedited(true)
                        .build()
                    if (scheduler.schedule(expedited) == JobScheduler.RESULT_SUCCESS) return
                }
                scheduler.schedule(JobInfo.Builder(UpcomingBillsWidgetContract.REFRESH_JOB_ID, component).build())
            } catch (error: RuntimeException) {
                Log.e(TAG, "Couldn't schedule the widget refresh", error)
            }
        }

        fun cancel(context: Context) {
            context.getSystemService(JobScheduler::class.java)?.cancel(UpcomingBillsWidgetContract.REFRESH_JOB_ID)
        }
    }
}
