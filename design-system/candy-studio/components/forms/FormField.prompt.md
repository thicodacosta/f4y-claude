Label + control + hint/error wrapper for React Hook Form + Zod forms.
```jsx
<FormField label="Work email" required error={errors.email?.message}><Input {...register('email')} /></FormField>
```