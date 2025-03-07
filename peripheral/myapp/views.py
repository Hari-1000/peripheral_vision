from django.shortcuts import render
from .models import VisionTestResult
import json
from django.http import JsonResponse

def test_page(request):
    return render(request, 'test.html')  # Changed from 'myapp/test.html'

def save_result(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        result = VisionTestResult(
            speed_mode=data['speed_mode'],
            field_left=data['field_left'],
            field_right=data['field_right'],
            missed_count=data['missed_count']
        )
        result.save()
        return JsonResponse({'status': 'success', 'id': result.id})
    return JsonResponse({'status': 'error'})