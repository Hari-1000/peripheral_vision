from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import models, schemas, auth
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Peripheral Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = auth.decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = auth.get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# --- Auth Routes ---

@app.post("/signup", response_model=schemas.UserOut)
def signup(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if auth.get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=data.email,
        username=data.username,
        hashed_password=auth.hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = auth.get_user_by_email(db, data.email)
    if not user or not auth.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = auth.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/forgot-password")
def forgot_password(data: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    user = auth.get_user_by_email(db, data.email)
    if not user:
        # Don't reveal if email exists
        return {"message": "If that email exists, a reset token has been generated."}
    token = auth.create_reset_token(db, user.id)
    # In production: send token via email. For now, return it directly.
    return {"message": "Reset token generated.", "reset_token": token}


@app.post("/reset-password")
def reset_password(data: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    success = auth.use_reset_token(db, data.token, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"message": "Password reset successful"}


# --- User ---

@app.get("/me", response_model=schemas.UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


# --- Training Results ---

@app.post("/results", response_model=schemas.TrainingResultOut)
def save_result(
    data: schemas.TrainingResultCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = models.TrainingResult(
        user_id=current_user.id,
        total_attempts=data.total_attempts,
        correct_responses=data.correct_responses,
        accuracy=data.accuracy,
        speed_setting=data.speed_setting
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


@app.get("/results", response_model=list[schemas.TrainingResultOut])
def get_results(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.TrainingResult).filter(
        models.TrainingResult.user_id == current_user.id
    ).order_by(models.TrainingResult.timestamp.desc()).all()


@app.delete("/results/{result_id}")
def delete_result(result_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    record = db.query(models.TrainingResult).filter(
        models.TrainingResult.id == result_id,
        models.TrainingResult.user_id == current_user.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")
    db.delete(record)
    db.commit()
    return {"status": "deleted"}


@app.delete("/results")
def delete_all_results(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    db.query(models.TrainingResult).filter(
        models.TrainingResult.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "all deleted"}
