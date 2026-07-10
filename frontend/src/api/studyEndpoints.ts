import { studyApi } from '../lib/studyApi';
import type { MenuCategoryDto, StudyBookingDto, StudyBookingStatus, StudyConfigDto, StudyResourceDto, UserDto } from '../types';

// Auth
export const login = (username: string, password: string) => studyApi.post<{ token: string }>('/auth/login', { username, password }).then((r) => r.data);
export const changePassword = (currentPassword: string, newPassword: string) =>
  studyApi.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

// Users
export const getUsers = () => studyApi.get<UserDto[]>('/users').then((r) => r.data);
export const createUser = (username: string, password: string) => studyApi.post<UserDto>('/users', { username, password }).then((r) => r.data);
export const updateUser = (id: string, data: Partial<{ username: string; active: boolean }>) =>
  studyApi.put<UserDto>(`/users/${id}`, data).then((r) => r.data);
export const resetUserPassword = (id: string, newPassword: string) => studyApi.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data);
export const deleteUser = (id: string) => studyApi.delete(`/users/${id}`);

// Resources (study tables/rooms)
export const getResources = () => studyApi.get<StudyResourceDto[]>('/resources').then((r) => r.data);
export const createResource = (data: { number: number; label?: string; kind: 'STUDY_TABLE' | 'STUDY_ROOM' }) =>
  studyApi.post<StudyResourceDto>('/resources', data).then((r) => r.data);
export const updateResource = (id: string, data: Partial<{ label: string; active: boolean }>) =>
  studyApi.put<StudyResourceDto>(`/resources/${id}`, data).then((r) => r.data);
export const deleteResource = (id: string) => studyApi.delete(`/resources/${id}`);

// Bookings
export const getBookings = (status?: StudyBookingStatus) =>
  studyApi.get<StudyBookingDto[]>('/bookings', { params: { status } }).then((r) => r.data);
export const createBooking = (tableId: string, customerName?: string) =>
  studyApi.post<StudyBookingDto>('/bookings', { tableId, customerName }).then((r) => r.data);
export const updateBooking = (id: string, data: Partial<{ customerName: string }>) =>
  studyApi.put<StudyBookingDto>(`/bookings/${id}`, data).then((r) => r.data);
export const addDrink = (id: string, menuItemId: string) => studyApi.post<StudyBookingDto>(`/bookings/${id}/drink`, { menuItemId }).then((r) => r.data);
export const resetTimer = (id: string) => studyApi.post<StudyBookingDto>(`/bookings/${id}/reset-timer`).then((r) => r.data);
export const completeBooking = (id: string, paymentMethod: 'CASH' | 'CARD') =>
  studyApi.post<StudyBookingDto>(`/bookings/${id}/complete`, { paymentMethod }).then((r) => r.data);
export const cancelBooking = (id: string) => studyApi.post<StudyBookingDto>(`/bookings/${id}/cancel`).then((r) => r.data);
export const deleteBooking = (id: string) => studyApi.delete(`/bookings/${id}`);

// Cafe menu (read-only, for the "add drink" picker)
export const getMenu = () => studyApi.get<MenuCategoryDto[]>('/bookings/menu').then((r) => r.data);

// Config
export const getConfig = () => studyApi.get<StudyConfigDto>('/config').then((r) => r.data);
export const updateConfig = (data: Partial<{ tableHourlyRate: number; roomHourlyRate: number; currency: string }>) =>
  studyApi.patch<StudyConfigDto>('/config', data).then((r) => r.data);
