from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class AuthUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email")


class SignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(validators=[])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("email", "password", "confirm_password")
        extra_kwargs = {"password": {"write_only": True}}

    def validate_email(self, value: str) -> str:
        normalized = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["Passwords do not match."]}
            )

        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": "No active account found with the given credentials.",
    }

    @classmethod
    def get_token(cls, user):
        return super().get_token(user)

    def validate(self, attrs):
        normalized_attrs = attrs.copy()
        if "email" in normalized_attrs:
            normalized_attrs["email"] = User.objects.normalize_email(attrs["email"])
        data = super().validate(normalized_attrs)
        data["user"] = AuthUserSerializer(self.user).data
        return data
