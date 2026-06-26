from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Enum as SQLEnum, or_, desc
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
import enum

# ================= 1. БАЗА ДАННЫХ =================
SQLALCHEMY_DATABASE_URL = "sqlite:///./tickets.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class StatusEnum(str, enum.Enum):
    new = "new"
    in_progress = "in progress"
    done = "done"

class PriorityEnum(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"

class TicketDB(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(120), nullable=False)
    description = Column(String(1000), nullable=True)
    status = Column(SQLEnum(StatusEnum), default=StatusEnum.new)
    priority = Column(SQLEnum(PriorityEnum), default=PriorityEnum.normal)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ================= 2. АВТОРИЗАЦИЯ АДМИНА =================
security = HTTPBasic()

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)):
    if credentials.username != "admin" or credentials.password != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# ================= 3. СХЕМЫ ДАННЫХ =================
class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    priority: PriorityEnum = PriorityEnum.normal

class TicketUpdateStatus(BaseModel):
    status: StatusEnum

class TicketResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: StatusEnum
    priority: PriorityEnum
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True} # Позволяет Pydantic читать данные из Алхимии

# ================= 4. РОУТЫ =================
app = FastAPI(title="Tickets API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Создание заявки
@app.post("/tickets", response_model=TicketResponse)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    db_ticket = TicketDB(**ticket.model_dump())
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

# 2-5. Получение списка (с пагинацией, фильтрами, поиском и сортировкой)
@app.get("/tickets", response_model=List[TicketResponse])
def get_tickets(
    skip: int = Query(0, ge=0), # Пагинация
    limit: int = Query(10, le=100), # Пагинация
    status: Optional[StatusEnum] = None, # Фильтр
    priority: Optional[PriorityEnum] = None, # Фильтр
    search: Optional[str] = None, # Поиск
    sort_by: Optional[str] = Query("created_at", pattern="^(created_at|priority)$"), # Сортировка
    sort_order: Optional[str] = Query("desc", pattern="^(asc|desc)$"), # Порядок сортировки
    db: Session = Depends(get_db)
):
    query = db.query(TicketDB)

    # Применяем фильтры
    if status:
        query = query.filter(TicketDB.status == status)
    if priority:
        query = query.filter(TicketDB.priority == priority)
    
    # Применяем поиск (по title ИЛИ description)
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(TicketDB.title.ilike(search_term), TicketDB.description.ilike(search_term)))

    # Применяем сортировку
    if sort_by == "created_at":
        query = query.order_by(desc(TicketDB.created_at) if sort_order == "desc" else TicketDB.created_at)
    elif sort_by == "priority":
        query = query.order_by(desc(TicketDB.priority) if sort_order == "desc" else TicketDB.priority)

    return query.offset(skip).limit(limit).all()

# 6. Изменение статуса
@app.patch("/tickets/{ticket_id}", response_model=TicketResponse)
def update_status(ticket_id: int, ticket_update: TicketUpdateStatus, db: Session = Depends(get_db)):
    # Ищем заявку по ID
    db_ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()
    
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if db_ticket.status == StatusEnum.done:
        raise HTTPException(status_code=400, detail="Нельзя редактировать заявку в статусе 'done'")

    # Обновляем статус
    db_ticket.status = ticket_update.status
    db_ticket.updated_at = datetime.utcnow()
    
    # Сохраняем изменения в базу
    db.commit()
    db.refresh(db_ticket)
    
    # Возвращаем обновленный объект
    return db_ticket

# 7. Удаление заявки (Только для админа)
@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)):
    # Ищем заявку
    db_ticket = db.query(TicketDB).filter(TicketDB.id == ticket_id).first()
    
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if db_ticket.status == StatusEnum.done:
        raise HTTPException(status_code=400, detail="Нельзя удалить заявку в статусе 'done'")

    # Удаляем из базы
    db.delete(db_ticket)
    db.commit()
    
    return {"detail": f"Заявка с ID {ticket_id} успешно удалена администратором"}