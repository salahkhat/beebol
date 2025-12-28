import { createRoot } from 'react-dom/client';
import '@radix-ui/themes/styles.css';
import './styles.css';
import { Theme } from '@radix-ui/themes';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './ui/Toast';
import { I18nProvider } from './i18n/i18n';
import { ThemeModeProvider, useThemeMode } from './ui/ThemeMode';

function Root() {
	const { appearance } = useThemeMode();
	return (
		<ToastProvider>
			<Theme appearance={appearance} accentColor="teal" grayColor="sand" radius="large">
				<I18nProvider>
					<AuthProvider>
						<App />
					</AuthProvider>
				</I18nProvider>
			</Theme>
		</ToastProvider>
	);
}

createRoot(document.getElementById('root')).render(
	<ThemeModeProvider>
		<Root />
	</ThemeModeProvider>,
);
