from django.db import models

class VisionTestResult(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    speed_mode = models.BooleanField(default=False)
    field_left = models.IntegerField(default=0)
    field_right = models.IntegerField(default=0)
    missed_count = models.IntegerField(default=0)

    def __str__(self):
        return f"Test {self.timestamp} (Speed: {self.speed_mode})"