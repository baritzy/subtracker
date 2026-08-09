package com.baritzy.subtracker.ui.navigation

import androidx.lifecycle.ViewModel
import com.baritzy.subtracker.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    val authRepository: AuthRepository
) : ViewModel()
