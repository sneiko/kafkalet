package profile

import (
	"fmt"

	keyring "github.com/zalando/go-keyring"
)

const keychainService = "kafkalet"

func keychainKey(profileID, brokerID string) string {
	return fmt.Sprintf("profile:%s:broker:%s:password", profileID, brokerID)
}

func namedCredentialKey(profileID, brokerID, credentialID string) string {
	return fmt.Sprintf("profile:%s:broker:%s:cred:%s:password", profileID, brokerID, credentialID)
}

func schemaRegistryKey(profileID, brokerID string) string {
	return fmt.Sprintf("profile:%s:broker:%s:schema-registry", profileID, brokerID)
}

// SavePassword stores the broker SASL password in the OS keychain.
func SavePassword(profileID, brokerID, password string) error {
	return keyring.Set(keychainService, keychainKey(profileID, brokerID), password)
}

// GetPassword retrieves the broker SASL password from the OS keychain.
// Returns ("", nil) if not set.
func GetPassword(profileID, brokerID string) (string, error) {
	pw, err := keyring.Get(keychainService, keychainKey(profileID, brokerID))
	if err == keyring.ErrNotFound {
		return "", nil
	}
	return pw, err
}

// DeletePassword removes the broker password from the OS keychain.
func DeletePassword(profileID, brokerID string) error {
	err := keyring.Delete(keychainService, keychainKey(profileID, brokerID))
	if err == keyring.ErrNotFound {
		return nil
	}
	return err
}

// SaveSchemaRegistryPassword stores the Schema Registry HTTP Basic password in the OS keychain.
func SaveSchemaRegistryPassword(profileID, brokerID, password string) error {
	return keyring.Set(keychainService, schemaRegistryKey(profileID, brokerID), password)
}

// GetSchemaRegistryPassword retrieves the Schema Registry password from the OS keychain.
// Returns ("", nil) if not set.
func GetSchemaRegistryPassword(profileID, brokerID string) (string, error) {
	pw, err := keyring.Get(keychainService, schemaRegistryKey(profileID, brokerID))
	if err == keyring.ErrNotFound {
		return "", nil
	}
	return pw, err
}

// DeleteSchemaRegistryPassword removes the Schema Registry password from the OS keychain.
func DeleteSchemaRegistryPassword(profileID, brokerID string) error {
	err := keyring.Delete(keychainService, schemaRegistryKey(profileID, brokerID))
	if err == keyring.ErrNotFound {
		return nil
	}
	return err
}

// SaveNamedCredentialPassword stores a named credential SASL password in the OS keychain.
func SaveNamedCredentialPassword(profileID, brokerID, credentialID, password string) error {
	return keyring.Set(keychainService, namedCredentialKey(profileID, brokerID, credentialID), password)
}

// GetNamedCredentialPassword retrieves a named credential SASL password from the OS keychain.
// Returns ("", nil) if not set.
func GetNamedCredentialPassword(profileID, brokerID, credentialID string) (string, error) {
	pw, err := keyring.Get(keychainService, namedCredentialKey(profileID, brokerID, credentialID))
	if err == keyring.ErrNotFound {
		return "", nil
	}
	return pw, err
}

// DeleteNamedCredentialPassword removes a named credential password from the OS keychain.
func DeleteNamedCredentialPassword(profileID, brokerID, credentialID string) error {
	err := keyring.Delete(keychainService, namedCredentialKey(profileID, brokerID, credentialID))
	if err == keyring.ErrNotFound {
		return nil
	}
	return err
}
