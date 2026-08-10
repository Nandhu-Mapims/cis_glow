import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import DashboardScreen from '../screens/DashboardScreen';
import MenuScreen from '../screens/MenuScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ModuleScreen from '../screens/ModuleScreen';

const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

function MenuStackNavigator() {
  return (
    <MenuStack.Navigator screenOptions={screenOptions}>
      <MenuStack.Screen name="MenuRoot" component={MenuScreen} options={{ title: 'Menu' }} />
      <MenuStack.Screen
        name="Module"
        component={ModuleScreen}
        options={({ route }) => ({ title: route.params?.title || 'Module' })}
      />
    </MenuStack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: route.name !== 'Menu',
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Menu" component={MenuStackNavigator} options={{ title: 'Menu' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
