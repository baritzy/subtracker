package com.baritzy.subtracker.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.baritzy.subtracker.data.repository.AuthRepository
import com.baritzy.subtracker.ui.login.LoginScreen
import com.baritzy.subtracker.ui.dashboard.DashboardScreen
import com.baritzy.subtracker.ui.history.HistoryScreen
import com.baritzy.subtracker.ui.calendar.CalendarScreen
import com.baritzy.subtracker.ui.trials.TrialsScreen
import com.baritzy.subtracker.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Dashboard : Screen("dashboard")
    data object History : Screen("history")
    data object Calendar : Screen("calendar")
    data object Trials : Screen("trials")
    data object Settings : Screen("settings")
}

@Composable
fun SubTrackerNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    val authRepository: AuthRepository = hiltViewModel<AuthViewModel>().authRepository
    val token by authRepository.token.collectAsStateWithLifecycle(initialValue = null)
    val isLoggedIn = token != null

    val startDestination = if (isLoggedIn) Screen.Dashboard.route else Screen.Login.route

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = {
            fadeIn(animationSpec = tween(220)) +
                    slideInVertically(initialOffsetY = { 40 }, animationSpec = tween(220))
        },
        exitTransition = {
            fadeOut(animationSpec = tween(150))
        },
        popEnterTransition = {
            fadeIn(animationSpec = tween(220))
        },
        popExitTransition = {
            fadeOut(animationSpec = tween(150)) +
                    slideOutVertically(targetOffsetY = { 20 }, animationSpec = tween(150))
        }
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToHistory = { navController.navigate(Screen.History.route) },
                onNavigateToCalendar = { navController.navigate(Screen.Calendar.route) },
                onNavigateToTrials = { navController.navigate(Screen.Trials.route) },
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
            )
        }

        composable(Screen.History.route) {
            HistoryScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Calendar.route) {
            CalendarScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Trials.route) {
            TrialsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}
