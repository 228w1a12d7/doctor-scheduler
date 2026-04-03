import os
from datetime import date, datetime, time, timedelta
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status

CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if CLOUDINARY_URL:
    cloudinary.config(
        cloudinary_url=CLOUDINARY_URL,
        secure=True,
    )
elif CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )


def is_cloudinary_configured() -> bool:
    return bool(CLOUDINARY_URL) or bool(
        CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
    )


def upload_image_to_cloudinary(image: UploadFile | None, folder: str) -> Optional[str]:
    if image is None:
        return None

    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured",
        )

    file_bytes = image.file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image file")

    try:
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            resource_type="image",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed",
        )

    image_url = upload_result.get("secure_url")
    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed",
        )

    return image_url


def parse_time_or_400(time_value: str) -> time:
    try:
        return datetime.strptime(time_value, "%H:%M").time()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time format: {time_value}. Use HH:MM",
        )


def time_to_minutes(value: time) -> int:
    return (value.hour * 60) + value.minute


def validate_time_range(start_time: str, end_time: str) -> tuple[time, time]:
    start = parse_time_or_400(start_time)
    end = parse_time_or_400(end_time)

    if time_to_minutes(end) <= time_to_minutes(start):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be greater than start_time",
        )

    if start.minute % 15 != 0 or end.minute % 15 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 15-minute slots allowed",
        )

    return start, end


def validate_15_minute_slot(time_value: str) -> time:
    parsed = parse_time_or_400(time_value)
    if parsed.minute % 15 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 15-minute slots allowed",
        )
    return parsed


def generate_15_min_slots(start_time: str, end_time: str) -> list[str]:
    start, end = validate_time_range(start_time, end_time)

    slots: list[str] = []
    current = datetime.combine(date.today(), start)
    end_dt = datetime.combine(date.today(), end)

    while current < end_dt:
        slots.append(current.strftime("%H:%M"))
        current += timedelta(minutes=15)

    return slots


def is_future_datetime(date_value: date, time_value: str) -> bool:
    parsed_time = parse_time_or_400(time_value)
    combined = datetime.combine(date_value, parsed_time)
    return combined > datetime.now()


def get_weekday_name(date_value: date) -> str:
    return date_value.strftime("%A")
