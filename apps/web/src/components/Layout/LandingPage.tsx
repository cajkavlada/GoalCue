import { useAuthActions } from "@gc/convex";

export function LandingPage() {
  const { signIn } = useAuthActions();
  return (
    <div id="webcrumbs">
      <div className="min-h-screen w-[100vw]">
        <main className="container mx-auto px-6 py-12">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-bold md:text-6xl">
              Master Your Time,
              <span className="text-primary-500"> Achieve Your Goals</span>
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-600">
              Transform your productivity with intelligent goal tracking,
              progress visualization, and personal achievement optimization
              tools.
            </p>

            <div className="mb-12">
              <button
                className="bg-primary hover:bg-primary-600 text-primary-foreground mx-auto flex items-center space-x-3 rounded-lg px-8 py-4 text-lg font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                onClick={() => void signIn("google")}
              >
                <span>Get Started</span>
              </button>
            </div>

            <div className="mb-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-white p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <span className="material-symbols-outlined text-2xl text-blue-500">
                    task_alt
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  Smart Task Management
                </h3>
                <p className="text-gray-600">
                  Organize and prioritize tasks with intelligent categorization
                  and deadline tracking.
                </p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <span className="material-symbols-outlined text-primary-500 text-2xl">
                    trending_up
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  Progress Tracking
                </h3>
                <p className="text-gray-600">
                  Monitor your achievements and productivity patterns with
                  detailed analytics.
                </p>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl md:col-span-2 lg:col-span-1">
                <div className="bg-primary-100 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <span className="material-symbols-outlined text-primary-500 text-2xl">
                    free_cancellation
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  Personal Time Optimization
                </h3>
                <p className="text-gray-600">
                  Maximize your free time with personalized scheduling and
                  activity recommendations.
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-16 bg-white/50 py-8 backdrop-blur-sm">
          <div className="container mx-auto px-6">
            <div className="flex flex-col items-center justify-between md:flex-row">
              <div className="mb-4 flex items-center space-x-2 md:mb-0">
                <span className="text-xl font-bold text-gray-800">GoalCue</span>
              </div>
              <div className="flex space-x-6">
                <a
                  href="#"
                  className="hover:text-primary-500 text-gray-600 transition-colors duration-300"
                >
                  Privacy Policy
                </a>
                <a
                  href="#"
                  className="hover:text-primary-500 text-gray-600 transition-colors duration-300"
                >
                  Terms of Service
                </a>
                <a
                  href="#"
                  className="hover:text-primary-500 text-gray-600 transition-colors duration-300"
                >
                  Support
                </a>
              </div>
            </div>
            <div className="mt-4 text-center text-gray-500">
              <p>&copy; 2025 GoalCue. All rights reserved.</p>
            </div>
          </div>
        </footer>
        {/* Next: "Add testimonials section with user reviews" */}
      </div>
    </div>
  );
}
