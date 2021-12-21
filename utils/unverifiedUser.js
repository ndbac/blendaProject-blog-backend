const unverifiedUser = (user) => {
    if (!user?.isAccountVerified) {
      throw new Error(`Access denied as ${user?.firstName} is not verified`);
    }
  };
  
  module.exports = unverifiedUser;
  