import { useEffect, useState } from 'react'
import axios from 'axios'

interface Ticket {
  id: number
  title: string
  description: string
  status: 'new' | 'in progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  created_at: string
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Фильтры и поиск
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  // Сортировка и пагинация
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(0)

  // Новая заявка
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState('normal')

  // Функция запроса на бэкенд
  const fetchTickets = async () => {
    setLoading(true)
    try {
      const response = await axios.get('http://localhost:8000/tickets', {
        params: {
          skip: page * 10,
          limit: 10,
          search: search || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          sort_by: sortBy,
          sort_order: sortOrder
        }
      })
      setTickets(response.data)
    } catch (error) {
      console.error('Ошибка при загрузке:', error)
    } finally {
      setLoading(false)
    }
  }

  // Следим за изменениями всех фильтров
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTickets()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [search, statusFilter, priorityFilter, sortBy, sortOrder, page])

  // Создание
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:8000/tickets', {
        title: newTitle,
        description: newDesc,
        priority: newPriority
      })
      setNewTitle('')
      setNewDesc('')
      fetchTickets()
    } catch (error) {
      alert('Ошибка при создании заявки. Проверьте длину названия.')
    }
  }

  // Изменение статуса
  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await axios.patch(`http://localhost:8000/tickets/${id}`, { status: newStatus })
      fetchTickets()
    } catch (error) {
      alert('Ошибка: нельзя редактировать эту заявку')
    }
  }

  // Удаление (с базовой авторизацией)
  const handleDelete = async (id: number) => {
    if (!window.confirm('Точно удалить заявку?')) return
    try {
      await axios.delete(`http://localhost:8000/tickets/${id}`, {
        auth: { username: 'admin', password: 'admin' }
      })
      fetchTickets()
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert('Нельзя удалить заявку в статусе done')
      } else {
        alert('Ошибка при удалении. Проверьте права доступа.')
      }
    }
  }

  // Переключатель админа
  const toggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false)
    } else {
      const pwd = prompt('Введите пароль админа (admin):')
      if (pwd === 'admin') setIsAdmin(true)
      else if (pwd) alert('Неверный пароль!')
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Система учета заявок</h1>
        <button onClick={toggleAdmin} style={{ padding: '8px 15px', background: isAdmin ? '#dc3545' : '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {isAdmin ? 'Выйти (Админ)' : 'Войти как Админ'}
        </button>
      </div>

      {/* Форма создания */}
      <div style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <h3>Создать заявку</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input placeholder="Название (мин. 3 символа)" value={newTitle} onChange={e => setNewTitle(e.target.value)} required style={{ padding: 8, flex: 1 }} />
          <input placeholder="Описание" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ padding: 8, flex: 1 }} />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ padding: 8 }}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <button type="submit" style={{ padding: '9px 15px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Добавить</button>
        </form>
      </div>

      {/* Панель фильтров, поиска и сортировки */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 15, marginBottom: 20, background: '#eee', padding: 10, borderRadius: 8 }}>
        <input placeholder="Поиск..." value={search} onChange={e => {setSearch(e.target.value); setPage(0)}} style={{ padding: 8, flex: 1, minWidth: 200 }} />
        
        <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setPage(0)}} style={{ padding: 8 }}>
          <option value="">Все статусы</option>
          <option value="new">New</option>
          <option value="in progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        
        <select value={priorityFilter} onChange={e => {setPriorityFilter(e.target.value); setPage(0)}} style={{ padding: 8 }}>
          <option value="">Все приоритеты</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: 8 }}>
          <option value="created_at">Сортировка: По дате</option>
          <option value="priority">Сортировка: По приоритету</option>
        </select>
        
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: 8 }}>
          <option value="desc">По убыванию</option>
          <option value="asc">По возрастанию</option>
        </select>
      </div>

      {/* Таблица */}
      {loading ? (
        <div>Загрузка...</div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>Заявок не найдено</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', textAlign: 'left' }}>
              <th style={{ padding: 10, border: '1px solid #ddd' }}>ID</th>
              <th style={{ padding: 10, border: '1px solid #ddd' }}>Название</th>
              <th style={{ padding: 10, border: '1px solid #ddd' }}>Описание</th>
              <th style={{ padding: 10, border: '1px solid #ddd' }}>Статус</th>
              <th style={{ padding: 10, border: '1px solid #ddd' }}>Приоритет</th>
              {isAdmin && <th style={{ padding: 10, border: '1px solid #ddd' }}>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td style={{ padding: 10, border: '1px solid #ddd' }}>{ticket.id}</td>
                <td style={{ padding: 10, border: '1px solid #ddd' }}>{ticket.title}</td>
                <td style={{ padding: 10, border: '1px solid #ddd' }}>{ticket.description || '—'}</td>
                
                {/* Выпадающий список для статуса прямо в таблице */}
                <td style={{ padding: 10, border: '1px solid #ddd' }}>
                  <select 
                    value={ticket.status} 
                    onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                    disabled={ticket.status === 'done'}
                    style={{ padding: 4 }}
                  >
                    <option value="new">New</option>
                    <option value="in progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </td>
                
                <td style={{ padding: 10, border: '1px solid #ddd' }}>{ticket.priority}</td>
                
                {/* Кнопка удаления для админа */}
                {isAdmin && (
                  <td style={{ padding: 10, border: '1px solid #ddd', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(ticket.id)}
                      disabled={ticket.status === 'done'}
                      style={{ 
                        background: ticket.status === 'done' ? '#ccc' : '#dc3545', 
                        color: '#fff', border: 'none', padding: '5px 10px', 
                        borderRadius: 4, cursor: ticket.status === 'done' ? 'not-allowed' : 'pointer' 
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Пагинация */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 15, alignItems: 'center' }}>
        <button 
          onClick={() => {
            setLoading(true);
            setPage(p => Math.max(0, p - 1));
          }} 
          disabled={page === 0 || loading}
          style={{ padding: '8px 15px', cursor: page === 0 || loading ? 'not-allowed' : 'pointer' }}
        >
          Назад
        </button>
        
        <span>Страница {page + 1}</span>
        
        <button 
          onClick={() => {
            setLoading(true);
            setPage(p => p + 1);
          }} 
          disabled={tickets.length < 10 || loading}
          style={{ padding: '8px 15px', cursor: tickets.length < 10 || loading ? 'not-allowed' : 'pointer' }}
        >
          Вперед
        </button>
      </div>
    </div>
  )
}

export default App
