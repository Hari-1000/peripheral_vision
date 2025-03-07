from django.urls import path
from . import views

urlpatterns = [
    path('', views.test_page, name='test_page'),
    path('save_result/', views.save_result, name='save_result'),
]